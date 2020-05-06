import React from "react";
import PropTypes from "prop-types";
import Markdown from "./Markdown";

class CategoriesPanel extends React.Component {
  constructor(props) {
    super(props);
    this.categories = props.categories;
    this.state = { selectedCategory: props.categories[0], selectedLevel: 0 };
    this.dispatchSelectCategoryLevel = props.selectCategoryLevel;
  }

  getLevel = category =>
    this.props.selectedLevels[category.key]
      ? this.props.selectedLevels[category.key]
      : 0;

  getKPIs = () =>
    this.state.selectedCategory.getKpisByLevel(
      this.getLevel(this.state.selectedCategory)
    );

  getKPIsPercentage = () =>
    (this.getLevel(this.state.selectedCategory) * 100) /
    this.state.selectedCategory.getLevels().length;

  selectCategory = (category, e) => {
    e.preventDefault();
    this.setState({
      selectedCategory: category,
      selectedLevel: this.getLevel(category)
    });
  };

  selectLevel = (level, category, e) => {
    e.preventDefault();
    this.setState({ selectedLevel: level });
    this.dispatchSelectCategoryLevel(category, level);
  };

  render = () => (
    <section id="category-panel">
      <div className="row">
        <div className="col-md-3">
          <ul className="category-nav nav flex-column nav-pills">
            {this.categories.map(category => (
              <li key={category.key} className="nav-item">
                <a
                  className={
                    "nav-link" +
                    (this.state.selectedCategory.key === category.key
                      ? " active "
                      : "")
                  }
                  href="#category-panel"
                  onClick={this.selectCategory.bind(this, category)}
                >
                  {category.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-9">
          <h4>{this.state.selectedCategory.name}</h4>
          <ul className="levels-nav nav nav-pills justify-content-end">
            {this.state.selectedCategory.getLevels().map(level => (
              <li key={level} className="nav-item">
                <a
                  href="#category-panel"
                  className={
                    "nav-link" +
                    (this.getLevel(this.state.selectedCategory) >= level
                      ? " active "
                      : "")
                  }
                  onClick={this.selectLevel.bind(
                    this,
                    level,
                    this.state.selectedCategory
                  )}
                >
                  Level {level}
                </a>
              </li>
            ))}
          </ul>

          <div className="progress">
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: this.getKPIsPercentage().toString() + "%" }}
              aria-valuenow="25"
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>

          {this.getKPIs().map((kpi, index) => (
            <div className="kpi" key={index}>
              <h5>{kpi.summary}</h5>
              <Markdown input={kpi.description} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

CategoriesPanel.propTypes = {
  selectedLevels: PropTypes.object.isRequired,
  categories: PropTypes.arrayOf(Object).isRequired,
  selectCategoryLevel: PropTypes.func
};

export default CategoriesPanel;
