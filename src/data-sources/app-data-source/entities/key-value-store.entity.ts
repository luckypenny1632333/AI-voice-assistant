import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('key_value_store')
export class KeyValueStore {
  @PrimaryColumn({ type: 'text' })
  app!: string;

  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}
