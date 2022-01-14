import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "VoiceData" })
export class VoiceData {
  @PrimaryColumn()
  UserID!: string;

  @Column({ default: 0 })
  CallTime!: number;

  @Column({ default: 0 })
  MutedTime!: number;
}
