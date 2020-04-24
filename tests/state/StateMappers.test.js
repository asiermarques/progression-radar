import {
  queryParamaDataToUrl,
  extractQueryStringData
} from "../../src/state/StateMappers";

it("should generate an url for the state", () => {
  expect(queryParamaDataToUrl()).toBe("/?state");
  expect(queryParamaDataToUrl({})).toBe("/?state={}");
  expect(queryParamaDataToUrl({ test: "test" })).toBe(
    '/?state={"test":"test"}'
  );
});

it("should extract the state from the url", () => {
  expect(extractQueryStringData()).toStrictEqual(null);
  expect(extractQueryStringData('state={"test":"test"}')).toStrictEqual({
    test: "test"
  });
  expect(extractQueryStringData('?state={"test":"test"}')).toStrictEqual({
    test: "test"
  });
});
