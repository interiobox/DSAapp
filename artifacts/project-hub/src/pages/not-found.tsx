export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6 bg-card border rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold font-mono text-primary tracking-tight">
          404
        </h1>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Sheet Not Found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The drawing or page you are looking for has been archived, moved, or never existed in the library.
        </p>
        <div className="mt-6">
          <a href="/drawings" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            Return to Library
          </a>
        </div>
      </div>
    </div>
  );
}