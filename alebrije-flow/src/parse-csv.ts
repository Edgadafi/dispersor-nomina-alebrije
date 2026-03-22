/**
 * Parser de CSV para nómina.
 */
export interface CsvRow {
  amount: string;
  stellar_address?: string;
  phone?: string;
  employee_id?: string;
  date_of_birth?: string;
}

export function parseCsvFromString(csvContent: string): CsvRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2)
    throw new Error("CSV necesita encabezado y al menos una fila");
  const header = lines[0]
    .toLowerCase()
    .split(",")
    .map((c) => c.trim());
  const addrIdx = header.findIndex(
    (c) => c === "stellar_address" || c === "stellar address"
  );
  const amountIdx = header.indexOf("amount");
  if (amountIdx < 0) throw new Error("CSV necesita columna 'amount'");
  const phoneIdx = header.findIndex((c) => c === "phone");
  const empIdx = header.findIndex(
    (c) => c === "employee_id" || c === "employee id"
  );
  const dobIdx = header.findIndex(
    (c) => c === "date_of_birth" || c === "date of birth"
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const amount = vals[amountIdx] ?? "0";
    const stellar_address = addrIdx >= 0 ? vals[addrIdx] : undefined;
    const phone = phoneIdx >= 0 ? vals[phoneIdx] : undefined;
    const employee_id = empIdx >= 0 ? vals[empIdx] : undefined;
    const date_of_birth = dobIdx >= 0 ? vals[dobIdx] : undefined;
    rows.push({ amount, stellar_address, phone, employee_id, date_of_birth });
  }
  return rows;
}
