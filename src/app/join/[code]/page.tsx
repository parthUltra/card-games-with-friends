import { redirect } from "next/navigation";

type Props = { params: Promise<{ code: string }> };

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  redirect(`/lobby/${code.toUpperCase()}`);
}
