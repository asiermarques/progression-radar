# Progression radar
[![CircleCI](https://circleci.com/gh/asiermarques/progression-radar.svg?style=svg)](https://circleci.com/gh/asiermarques/progression-radar)

Progression Radar is a simple visualization tool for career and learning paths. 

## Motivation

Progression radar is designed as a tool for visualizing the progression in different areas related to a career growth plan or career path or a learning path.

Inspired in the deprecated Medium's snowflake tool, it shows your progress in the levels within the areas you configure.  
Also, you can compare your progress and levels with the ones that are required by other configured roles.

The app doesn't require a database or a backend; all the status data will be passed thought a url query parameter.

## Status

This project is still in wip; there is no release yet.

## Getting started

To start to use the app, you need to copy the configuration data files.

```
cp ./src/data/categories.yml.dist ./src/data/categories.yml
cp ./src/data/roles.yml.dist ./src/data/roles.yml
```

And then, start the development server.

```
yarn start
```

## Customize your path

### Configure the categories

The categories represent the areas in your path, i.e.: communication, software engineering. All the categories are configured in the ./src/data/categories.yaml file.

Every category will be an entry of a YAML array with these fields specified on it:

| field       | description                                       | 
|-------------|---------------------------------------------------|
| key         | a unique and short identifier for the category   |
| name        | the name for the category                         |
| description | a brief description of the category               |
| kpis        | an array of KPIs or skills for the category       |

**KPIs**

Each category has a list of KPIs. A KPI is a skill, behavior, or concept that you need to master to reach a level in a specific category.  

Each KPI will be an entry of the **kpis** category field and will have these fields specified on it:

| field       | description                                               | 
|-------------|-----------------------------------------------------------|
| summary     | a title of a brief description of the KPI                   |
| description | an extended description of the KPI. Markdown is supported |
| tags        | a simple array of tags for this KPI                       |
| level       | a numeric level for this skill                            |

**Example**

```yaml
# categories.yaml
- 
  key: ps
  name: Problem-solving
  description: Shares the right amount of information with the right people, at the right time, and listens effectively
  kpis: 
    - 
      summary: Communicates effectively to close stakeholders when called upon, and incorporates constructive feedback
      description:  >
        **Example behaviors:**

        * Communicates project status clearly and effectively

        * Collaborates with others with empathy

        * Asks for help at the appropriate juncture  


        **Example tasks:** 

        * Updated The Watch before running a backfill

        * Updated project status changes in Asana promptly
        
        * Gave thoughtful check-in and check-out comments

      tags: ["tech", "management"]
      level: 1
```

### Configure the roles

A role is a step in your ladder. You will grow from one role to another, reaching specific levels in each category.  
All the roles are configured in the ./src/data/roles.yaml file.

Every role will be an entry of a YAML array with this fields specified on it:

| field       | description                                                                       | 
|-------------|-----------------------------------------------------------------------------------|
| key         | a unique and short identifier for the role                                       |
| name        | the name for the role, i.e., Senior Backend Engineer                                |
| levels      | represent the levels that the role requires for the configured categories. It is an object with key-value fields. <br>The key is for a category's key and the value is for that category level, i.e.: { ps: 1, comm: 3, ...} |

**Example**

```yaml
# roles.yaml
-
  key:  aswe
  name: Associate Software Engineer
  levels: { comm: 1, ps: 1, rs: 1, des: 1, fin: 1, data: 1, front: 1, back: 1, infra: 1 }
```

### The status info passed by url

The information to visualize the progress of a person is passed by an url query parameter named *state*. 

This param expect a json object with the following fields:

| field       | description                                                 | 
|-------------|-------------------------------------------------------------|
| name        | the person's name                                           |
| levels      | represent the levels that the person has reached for the configured categories. It is an object with key-value fields. <br>The key is for a category's key and the value is for that category level, i.e.: { ps: 1, comm: 3, ...} | 
| roleKey     | the person's current role                                   |
| tags        | a simple array of tags that this person is interested about |
| compareTo   | optional: a role that will be used for a level comparison   |


**Example**

```
/?state={name: "John Connor", levels: { comm: 2, ps: 1, rs: 2, des: 1, res: 1, fin: 1, data: 1, front: 1, back: 1, infra: 1 }, roleKey: "aswe", tags: ["tech"], compareTo:  "swe"}
```

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

