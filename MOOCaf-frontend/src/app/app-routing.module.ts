import { NgModule } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';

import { AuthGuard } from "./shared/auth-guard";
import { HomeComponent } from "./home/home.component";
import { LoginComponent } from "./login/login.component";
import { SignupComponent } from "./signup/signup.component";
import { AwardsComponent } from "./awards/awards.component";
import { CatalogueComponent } from "./catalogue/catalogue.component";
import { CoursePageComponent } from "./course/course-page/course-page.component";
import { ProgressionComponent } from "./progression/progression.component";
import { NotFoundComponent } from "./not-found/not-found.component";
import { UserComponent } from "./user/user.component";

const routes: Routes = [
  { path: '',             redirectTo: '/home', pathMatch: 'full' },
  { path: 'home',         component: HomeComponent  },
  { path: 'login',        component: LoginComponent },
  { path: 'signup',       component: SignupComponent },
  { path: 'awards',       component: AwardsComponent,       canActivate: [AuthGuard] },
  { path: 'catalogue',    component: CatalogueComponent,    canActivate: [AuthGuard] },
  { path: 'class',        component: CatalogueComponent,    canActivate: [AuthGuard], data: {onlyCurrent: true} },
  { path: 'class/:id',    component: CoursePageComponent,   canActivate: [AuthGuard] },
  { path: 'progress',     component: ProgressionComponent,  canActivate: [AuthGuard] },
  { path: 'users',        component: UserComponent,         canActivate: [AuthGuard] },
  // Show the 404 page for any routes that don't exist.
  { path: '**',           component: NotFoundComponent }
];


@NgModule( {
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

