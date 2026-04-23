export class AuthoritativeTaskStoreLegacyCompat {
    withConnection(work) {
        return work(this.db.connection);
    }
}
//# sourceMappingURL=authoritative-task-store-legacy-compat.js.map