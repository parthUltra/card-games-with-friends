import { MongoClient, Db, Collection, Document } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri() {
  return (
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cardgames"
  );
}

function createClient() {
  return new MongoClient(getUri());
}

const clientPromise =
  global._mongoClientPromise ?? createClient().connect();

if (process.env.NODE_ENV !== "production") {
  global._mongoClientPromise = clientPromise;
}

export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "cardgames");
}

export async function getCollection<T extends Document>(
  name: string,
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
