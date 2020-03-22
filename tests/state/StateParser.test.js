import StateParser from "../../src/state/StateParser";


it("should generate an url for the state", () => {
    const TestStateParser = new StateParser();
    expect(TestStateParser.toUrl()).toBe('/?state');
    expect(TestStateParser.toUrl({})).toBe('/?state={}');
    expect(TestStateParser.toUrl({test: 'test'})).toBe('/?state={"test":"test"}');
});

it("should parse the state in the url", () => {
    const TestStateParser = new StateParser();
    expect(TestStateParser.parseFromUrl()).toStrictEqual(null);
    expect(TestStateParser.parseFromUrl('state={"test":"test"}')).toStrictEqual({test: "test"});
    expect(TestStateParser.parseFromUrl('?state={"test":"test"}')).toStrictEqual({test: "test"});
});