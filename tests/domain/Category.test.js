import Category from "../../src/domain/Category";
import KPI from "../../src/domain/KPI";


it("should be instantiated", () => {
    const TestCategory = new Category('test', 'test_name', []);
    expect(TestCategory.getKey()).toBe('test');
});

it("should return a list with all levels", () => {
    const KPIs = [
        new KPI('test', 'test', 1, ['test']),
        new KPI('test', 'test', 1, ['test']),
        new KPI('test', 'test', 2, ['test']),
        new KPI('test', 'test', 3, ['test'])
    ];
    const TestCategory = new Category('test', 'test_name', KPIs);
    expect(TestCategory.getLevels()).toStrictEqual([1, 2, 3]);
});

it("should return KPIs by levels", () => {
    const KPIs = [
        new KPI('test', 'test', 1, ['test']),
        new KPI('test', 'test', 1, ['test']),
        new KPI('test', 'test', 2, ['test']),
        new KPI('test', 'test', 3, ['test'])
    ];
    const TestCategory = new Category('test', 'test_name', KPIs);
    expect(TestCategory.getKpisByLevel(1)).toStrictEqual([KPIs[0], KPIs[1]]);
    expect(TestCategory.getKpisByLevel(4)).toStrictEqual([]);
});
