import { redirect } from 'next/navigation';

export default function SalesReportsRedirect() {
  redirect('/dashboard/reports/reports-index');
}

