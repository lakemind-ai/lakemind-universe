import React from "react";
import { Router, Route, Switch, Redirect } from "react-router-dom";
import { createBrowserHistory } from "history";
import { AppLayout } from "@/components/layout/applayout";
import { LoginPage } from "@/components/auth/loginpage";
import { LogoutPage } from "@/components/auth/logoutpage";
import { AuthCallback } from "@/components/auth/authcallback";
import HomePage from "@/components/home/homepage";
import { ScanPage } from "@/components/scan/scanpage";
import { EntityDetailPage } from "@/components/entity/entitydetailpage";
import { EntityHub } from "@/components/entity/entityhub";
import { PublishPage } from "@/components/publish/publishpage";
import { PageHeader } from "@/components/reusable/page-header";
import { RealmsPage } from "@/components/realm/realmspage";
import { LexiconPage } from "@/components/lexicon/lexiconpage";
import { ChroniclePage } from "@/components/chronicle/chroniclepage";
import { DatalensPage } from "@/components/datalens/datalenspage";

const history = createBrowserHistory();

const App = () => {
  return (
    <Router history={history}>
      <Switch>
        {/* Public routes */}
        <Route path="/login">
          <AppLayout requireAuth={false}>
            <LoginPage />
          </AppLayout>
        </Route>
        <Route path="/logout">
          <AppLayout requireAuth={false}>
            <LogoutPage />
          </AppLayout>
        </Route>
        <Route path="/auth/callback">
          <AuthCallback />
        </Route>

        {/* Private routes */}
        <Route path="/scan">
          <AppLayout>
            <ScanPage />
          </AppLayout>
        </Route>
        <Route path="/entities">
          <AppLayout>
            <EntityHub />
          </AppLayout>
        </Route>
        <Route path="/entity/:id">
          <AppLayout>
            <EntityDetailPage />
          </AppLayout>
        </Route>
        <Route path="/realms">
          <AppLayout>
            <RealmsPage />
          </AppLayout>
        </Route>
        <Route path="/lexicon">
          <AppLayout>
            <LexiconPage />
          </AppLayout>
        </Route>
        <Route path="/chronicle">
          <AppLayout>
            <ChroniclePage />
          </AppLayout>
        </Route>
        <Route path="/datalens">
          <AppLayout>
            <DatalensPage />
          </AppLayout>
        </Route>
        <Route exact path="/">
          <Redirect to="/scan" />
        </Route>
        <Route path="/">
          <AppLayout>
            <HomePage />
          </AppLayout>
        </Route>
      </Switch>
    </Router>
  );
};

export default App;
