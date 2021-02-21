import { voidCatch } from '../utils';
import jsonfile from 'jsonfile';

class MyStoreRecord<T> {
  private store: MyStore<T>;
  private key: string;

  constructor(store: MyStore<T>, key: string) {
    this.store = store;
    this.key = key;
  }

  load = () => {
    this.store.load();

    return this;
  }

  save = () => {
    this.store.save();

    return this;
  }

  set = (value: T) => {
    this.store.set(this.key, value);

    return this;
  }

  value = () => {
    return this.store.value()[this.key];
  }
}

export class MyStore<T> {
  private store: {[key: string]: T} = {};
  private name: string;
  private mapper?: (raw: {[key: string]: T}) => {[key: string]: T};

  constructor(name: string, mapper?: (raw: {[key: string]: T}) => {[key: string]: T}) {
    this.name = name;
    this.mapper = mapper;

    this.load();
  }

  load = async () => {
    let temp = await jsonfile.readFile(`./store/${this.name}.json`, { throws: false }).catch(voidCatch);
    if (temp && this.mapper !== undefined) {
      temp = this.mapper(temp);
    }
    Object.assign(this.store, temp as {[key: string]: T});

    return this;
  }

  save = async () => {
    await jsonfile.writeFile(`./store/${this.name}.json`, this.store, { spaces: 2 });

    return this;
  }

  get = (key: string) => {
    return new MyStoreRecord<T>(this, key);
  }

  set = (key: string, value: T) => {
    this.store[key] = value;

    return this.get(key);
  }

  value = () => {
    return this.store;
  }
}
