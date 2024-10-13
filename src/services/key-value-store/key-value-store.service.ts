import { AppDataSource } from '../../data-sources/app-data-source/app-data-source';
import { KeyValueStore } from '../../data-sources/app-data-source/entities/key-value-store.entity';
import { Repository } from 'typeorm';

export class KeyValueStoreService {
  private repository!: Repository<KeyValueStore>;

  constructor(private readonly app: string) {
    // Ensure that the DataSource is initialized before accessing the repository
    if (!AppDataSource.isInitialized) {
      AppDataSource.initialize()
        .then(() => {
          this.repository = AppDataSource.getRepository(KeyValueStore);
        })
        .catch((error: Error) => console.error('Error initializing data source:', error));
    } else {
      this.repository = AppDataSource.getRepository(KeyValueStore);
    }
  }

  private buildKey(key: string, keyPrefix?: string): string {
    return keyPrefix ? `${keyPrefix}__${key}` : key;
  }

  // Method to set a key-value pair
  async setKeyValue(key: string, value: string, keyPrefix?: string): Promise<void> {
    const existingEntry = await this.repository.findOne({
      where: { app: this.app, key: this.buildKey(key, keyPrefix) },
    });

    if (existingEntry) {
      existingEntry.value = value;
      await this.repository.save(existingEntry);
    } else {
      const newEntry = this.repository.create({ app: this.app, key, value });
      await this.repository.save(newEntry);
    }
  }

  // Method to get a value by key
  async getValue(key: string, keyPrefix?: string): Promise<string | null> {
    const entry = await this.repository.findOne({
      where: { app: this.app, key: this.buildKey(key, keyPrefix) },
    });
    return entry ? entry.value : null;
  }

  // Method to get a value by key
  async getAll(key: string, keyPrefix?: string): Promise<string[] | null> {
    const entry = await this.repository.find({
      where: { app: this.app, key: this.buildKey(key, keyPrefix) },
    });
    return entry ? entry.map((e) => e.value) : null;
  }

  // Method to delete a key-value pair
  async deleteKey(key: string, keyPrefix?: string): Promise<void> {
    await this.repository.delete({ app: this.app, key: this.buildKey(key, keyPrefix) });
  }
}
