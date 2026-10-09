/** Static skeleton while a route loads. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-12 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 rounded-[6px] bg-sunken" />
      <div className="mt-3 h-4 w-1/2 rounded-[6px] bg-sunken" />
      <div className="mt-10 space-y-3">
        <div className="h-12 rounded-[10px] bg-sunken" />
        <div className="h-12 rounded-[10px] bg-sunken" />
        <div className="h-12 rounded-[10px] bg-sunken" />
      </div>
    </div>
  );
}
