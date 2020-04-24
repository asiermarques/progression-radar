import React from "react";
import Layout from "../components/Layout";
import Footer from "../components/Footer";

export default props => (
  <Layout>
    <div className="container">
      <section className="row">
        <div className="col-sm col-md-12">
          <h1 className="title">合 Progression Radar</h1>

          <div class="alert alert-primary" role="alert">
            You need to specify a state param in the query url that match with
            the following json schema:
          </div>

          <pre>
            <code>{props.schema}</code>
          </pre>
        </div>
      </section>

      <Footer />
    </div>
  </Layout>
);
