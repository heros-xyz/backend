import { MigrateOptions } from "fireway";

const benefits = [
  {
    key: "early-access-content",
    label: "Early access to content",
  },
  {
    key: "interact-athlete",
    label: "Interact with athlete",
  },
];

export async function migrate({ firestore }: MigrateOptions) {
  await firestore.collection("public").doc("benefits").set({ all: benefits });
}
