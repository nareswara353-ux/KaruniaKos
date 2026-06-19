export const LoadingFallback = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-pulse">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-primary/20 rounded-full" />
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
};