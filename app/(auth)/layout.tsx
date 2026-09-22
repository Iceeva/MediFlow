export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      <section className="hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-2xl font-bold">MediFlow</p>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl leading-tight">One calm place for every patient, visit and invoice.</h1>
          <p className="text-white/70">Appointments, records, prescriptions and billing for your whole clinic, with each clinic's data kept strictly separate.</p>
        </div>
        <p className="text-sm text-white/50">Demonstration build. Compliance with medical data regulations depends on your hosting and procedures.</p>
      </section>
      <main id="main" className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
