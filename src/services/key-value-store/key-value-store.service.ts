import { Repository } from 'typeorm';

import { AppDataSource, KeyValueStore } from '@/data-sources/app-data-source';

export class KeyValueStoreService {
  private repository!: Repository<KeyValueStore>;

  constructor(
    private readonly app: string,
    private readonly keyPrefix?: string
  ) {
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

  private buildKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}__${key}` : key;
  }

  // Method to set a key-value pair
  async setKeyValue(key: string, value: string): Promise<void> {
    const existingEntry = await this.repository.findOne({
      where: { app: this.app, key: this.buildKey(key) },
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
  async getValue(key: string): Promise<string | null> {
    const entry = await this.repository.findOne({
      where: { app: this.app, key: this.buildKey(key) },
    });
    return entry ? entry.value : null;
  }

  // Method to get a value by key
  async getAll(key: string): Promise<string[] | null> {
    const entry = await this.repository.find({
      where: { app: this.app, key: this.buildKey(key) },
    });
    return entry ? entry.map((e) => e.value) : null;
  }

  // Method to delete a key-value pair
  async deleteKey(key: string): Promise<void> {
    await this.repository.delete({ app: this.app, key: this.buildKey(key) });
  }
}
