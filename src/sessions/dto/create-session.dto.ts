import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  movieTitle!: string;

  @ApiProperty({ example: new Date().toISOString() })
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  room!: string;

  @ApiProperty({ example: 25.0 })
  @IsPositive()
  price!: number;

  @ApiProperty({ example: 16, minimum: 1 })
  @IsInt()
  @Min(16)
  seatsCount!: number;
}
