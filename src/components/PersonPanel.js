import React from 'react';
import PropTypes from 'prop-types';

const PersonPanel = (props) => <section id="person-panel">
        <h3 className="name">{props.name}</h3> 
        {props.role? <p className="role">{props.role.name}</p> : ""}
        <p>{props.tags.map(tag => <span key={tag} className="badge badge-success">{tag}</span> )}</p>
</section>;

PersonPanel.propTypes = {
  name: PropTypes.string,
  role: PropTypes.object,
  tags: PropTypes.arrayOf(String)
};

export default PersonPanel;