export function FieldError({ message }: { readonly message?: string }) {
  return message ? (
    <span className="text-sm font-medium text-red-700">{message}</span>
  ) : null;
}

export const errorMessage = (message: unknown) =>
  typeof message === "string" ? message : undefined;
