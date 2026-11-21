
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import {
  SQSClient,
  SendMessageCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';

import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

import {
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

import { randomUUID } from 'node:crypto';
import { TelemetryDto } from './dto/telemetry.dto.js';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  private readonly endpoint =
    process.env.AWS_ENDPOINT_URL;

  private readonly s3: S3Client;
  private readonly sqs: SQSClient;
  private readonly dynamodb: DynamoDBDocumentClient;

  constructor() {
    if (
      this.endpoint !== 'https://127.0.0.1:9297'
    ) {
      throw new Error(
        'Seguridad: AWS_ENDPOINT_URL debe apuntar al emulador local',
      );
    }

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      forcePathStyle: true,
    });

    this.sqs = new SQSClient({
      endpoint: this.endpoint,
      useQueueUrlAsEndpoint: false,
    });

    this.dynamodb = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        endpoint: this.endpoint,
      }),
    );
  }

  async processTelemetry(data: TelemetryDto) {
    const timestamp = new Date().toISOString();

    const bucket = process.env.S3_BUCKET_NAME!;
    const table = process.env.DYNAMODB_TABLE_NAME!;
    const queueName = process.env.SQS_QUEUE_NAME!;

    try {
      // 1. Guardar el estado actual en DynamoDB
      await this.dynamodb.send(
        new PutCommand({
          TableName: table,
          Item: {
            agentId: data.agentId,
            hostname: data.hostname,
            cpuUsage: data.cpuUsage,
            memoryUsage: data.memoryUsage,
            updatedAt: timestamp,
          },
        }),
      );

      this.logger.log(
        `[DynamoDB] Nodo actualizado: ${data.agentId}`,
      );

      // 2. Guardar un reporte histórico en S3
      const s3Key =
        `logs/${data.agentId}/${randomUUID()}.json`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: JSON.stringify({
            ...data,
            timestamp,
          }),
          ContentType: 'application/json',
        }),
      );

      this.logger.log(
        `[S3] Reporte guardado: ${s3Key}`,
      );

      // 3. Generar alerta si CPU >= 80%
      let alertTriggered = false;

      if (data.cpuUsage >= 80) {
        const result = await this.sqs.send(
          new GetQueueUrlCommand({
            QueueName: queueName,
          }),
        );

        if (!result.QueueUrl) {
          throw new Error('No se obtuvo la URL de SQS');
        }

        await this.sqs.send(
          new SendMessageCommand({
            QueueUrl: result.QueueUrl,
            MessageBody: JSON.stringify({
              type: 'HIGH_CPU_USAGE',
              agentId: data.agentId,
              cpuUsage: data.cpuUsage,
              timestamp,
            }),
          }),
        );

        alertTriggered = true;

        this.logger.warn(
          `[SQS] Alerta de CPU: ${data.cpuUsage}%`,
        );
      }

      return {
        status: 'processed',
        agentId: data.agentId,
        timestamp,
        s3Key,
        alertTriggered,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `Error procesando telemetría: ${message}`,
      );

      if (
        /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(
          message,
        )
      ) {
        throw new ServiceUnavailableException(
          'No se pudo conectar con AWS Emulator',
        );
      }

      throw new InternalServerErrorException(
        'No se pudo procesar la telemetría',
      );
    }
  }
}
