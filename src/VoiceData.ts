import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "VoiceData" })
export class VoiceData {
  @PrimaryColumn()
  UserID!: string;

  @Column()
  CallTime: number = 0;

  @Column()
  MutedTime: number = 0;
}
