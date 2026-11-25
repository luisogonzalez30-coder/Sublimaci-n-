import { AssistantChat } from "@/components/assistant-chat";

export const metadata = { title: "Asistente IA" };

export default function AsistentePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Asistente IA</h1>
      <AssistantChat />
    </main>
  );
}
