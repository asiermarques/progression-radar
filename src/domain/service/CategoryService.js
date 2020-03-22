
export default class CategoryService {

    constructor(repository) {
        this.categories = repository.getCategories()
    }

    getCategories = () => this.categories;

    categoriesWithLevels = (levels) => 
        this.categories.map(category => this.createCategoryLevel(category, ((levels && levels[category.key]) || 1)));

    createCategoryLevel = (category, level) => {
        const percentage = (level*100)/category.getLevels().length
        return {category, level, percentage: percentage<=100 ? percentage : 100 };
    }
}