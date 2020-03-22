import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown'

const MarkDown = (props) => <ReactMarkdown source={props.input} />

MarkDown.propTypes = {
    input: PropTypes.string.isRequired
};

export default MarkDown;