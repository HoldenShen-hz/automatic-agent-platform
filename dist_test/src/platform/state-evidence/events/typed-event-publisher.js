export class TypedEventBusPublisher {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    publish(input) {
        this.bus.publish(input);
    }
}
//# sourceMappingURL=typed-event-publisher.js.map