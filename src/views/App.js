import React from "react";
import Layout from "../components/Layout";
import Chart from "../containers/RadarChartContainer";
import CategoriesPanel from "../containers/CategoriesPanelContainer";
import PersonPanel from "../containers/PersonPanelContainer";
import CompareToRoleSelector from "../containers/CompareToRoleSelectorContainer";
import Footer from "../components/Footer";

export default props => (
  <Layout>
    <div className="container">
      <section className="row">
        <div className="col-sm-12 col-md-4">
          <h1 className="title">成長 Progression Radar</h1>
          <PersonPanel
            name={props.status.name}
            role={props.roles.reduce(
              (accum, currentRole) =>
                Object.assign(
                  accum,
                  currentRole.key === props.status.roleKey ? currentRole : {}
                ),
              {}
            )}
            tags={props.status.tags}
          ></PersonPanel>
          <CompareToRoleSelector roles={props.roles}></CompareToRoleSelector>
        </div>
        <div className="col-sm-12 col-md-8">
          <Chart colors={props.colors} />
        </div>
      </section>

      <CategoriesPanel categories={props.categories} />

      <Footer />
    </div>
  </Layout>
);
