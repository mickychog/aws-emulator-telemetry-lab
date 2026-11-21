
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class TelemetryDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @IsString()
  @IsNotEmpty()
  hostname!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  memoryUsage!: number;
}
