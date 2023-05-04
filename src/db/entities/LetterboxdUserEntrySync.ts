import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Relation } from "typeorm";
import { User } from "./User";
import { LetterboxdUserEntrySyncStatus, LetterboxdUserEntrySyncType } from "../../common/types/db";

@Entity()
export class LetterboxdUserEntrySync {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  status: LetterboxdUserEntrySyncStatus;

  @Column()
  type: LetterboxdUserEntrySyncType;

  @Column({ nullable: true })
  page?: number;

  @Column({ nullable: true })
  requestDate?: Date;

  @Column({ nullable: true })
  startDate?: Date;

  @Column({ nullable: true })
  endDate?: Date;

  @ManyToOne(() => User, (user) => user.letterboxdEntrySyncs)
  user: Relation<User>;

  @Column({ nullable: true })
  notes?: string;
}