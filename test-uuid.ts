
function isValidUuid(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

const id = "00000000-0000-0000-0000-000000000005";
console.log(`ID: ${id}, Valid: ${isValidUuid(id)}`);
