import {test,expect} from '@playwright/test';
test('public content, navigation, project preview and supplied repo',async({page})=>{
 await page.goto('/'); await expect(page.locator('#home h1')).toContainText('Amman Kumar D.');
 for(const id of ['home','about','skills','projects','certifications','achievements','contact'])await expect(page.locator(`#${id}`)).toHaveCount(1);
 await expect(page.locator('a[href="https://github.com/AMMANKUMARD100/ML-PROJECT"]')).toHaveCount(1);
 await page.getByRole('button',{name:/view project/i}).first().click();
 await expect(page.getByRole('dialog')).toContainText('Explainable AI integration');
 await page.getByRole('button',{name:'Close dialog'}).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('phone/tablet widths fit; mobile menu opens, navigates and closes',async({page})=>{
 await page.goto('/'); for(const width of [390,768,1024]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}px`).toBeTruthy();
 }
 await page.setViewportSize({width:390,height:844}); const menu=page.locator('.menu-toggle');
 await menu.click(); await expect(menu).toHaveAttribute('aria-expanded','true');
 await page.locator('.nav-links a[href="#projects"]').click(); await expect(page).toHaveURL(/#projects$/); await expect(menu).toHaveAttribute('aria-expanded','false');
});
test('admin deep links render protected unconfigured login, not CMS',async({page})=>{
 await page.goto('/admin/certificates'); await expect(page.locator('input[type="password"]')).toBeVisible();
 await expect(page.locator('.admin-shell')).toHaveCount(0); await expect(page.locator('.auth-form button')).toBeDisabled();
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
});
test('contact and resume do not claim cloud actions before setup',async({page})=>{
 await page.goto('/'); await expect(page.locator('.hero .button-row button')).toBeDisabled();
 await expect(page.locator('.contact-form button[type="submit"]')).toBeDisabled();
});
