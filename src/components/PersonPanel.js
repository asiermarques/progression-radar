import React from "react";
import PropTypes from "prop-types";

class PersonPanel extends React.Component {

    constructor(props) {
        super(props);
        this.dispatchUpdateName = props.updateName;
    }

    updateName = name => {
        const newName = window.prompt("choose a name", name);
        if(newName && newName.trim().length > 0)
            this.dispatchUpdateName(newName);
    }

    render = () => (
        <section id="person-panel">
            <h3 onClick={e => this.updateName(this.props.name)}
                className="name">{this.props.name}</h3>
            {this.props.role ? <p className="role">{this.props.role.name}</p> : ""}
            <p>
                {this.props.tags.map(tag => (
                    <span key={tag} className="badge badge-success">
                        {tag}
                    </span>
                ))}
            </p>
        </section>
    );
}

PersonPanel.propTypes = {
  name: PropTypes.string,
  role: PropTypes.object,
  tags: PropTypes.arrayOf(String),
  updateName: PropTypes.func
};

export default PersonPanel;
