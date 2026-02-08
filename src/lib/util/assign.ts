interface Update {
    <T extends {}>(target: T, ...sources: Partial<T>[]): T;
}

// strict Object.assign
export const { assign } = Object as { assign: Update }
export { assign as update }
