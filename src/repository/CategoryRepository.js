import categories from "../data/categories.yml";
import Category from "../domain/Category";

export class CategoryRepository {
  constructor() {
    this.categories = categories.map(
      configCategory =>
        new Category(
          configCategory.key,
          configCategory.name,
          configCategory.kpis
        )
    );
  }

  getCategories = () => this.categories;
}

export const categoryRepositoryInstance = new CategoryRepository();
