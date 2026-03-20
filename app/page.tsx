import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const host = (await headers()).get('host')?.toLowerCase() ?? ''

  if (host === 'demo.mcraftr.deployfaith.xyz') {
    redirect('/demo')
  }

  redirect('/login')
}
