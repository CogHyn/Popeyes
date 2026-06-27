import { createDashboardApp } from '@/dashboard/DashboardApp';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.replaceChildren(createDashboardApp());
}
