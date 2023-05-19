import { MigrateOptions } from "fireway";
import nations from "./nations.json";

export async function migrate({ firestore }: MigrateOptions) {
  await firestore
    .collection("public")
    .doc("nationalities")
    .set({ all: nations });
}
