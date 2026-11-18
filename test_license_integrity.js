/**
 * Верифікаційні тести ЛР №5: MDC SHA-256, підпис ліцензії (RSA публічний ключ), Freemium, цілісність конфігурації.
 * Запуск: node test_license_integrity.js   (node --print-digest — вивести еталонний дайджест конфігурації)
 */
const forge = require('node-forge');
const svc = require('./src/services/licenseIntegrityService.js');

if (process.argv.includes('--print-digest')) {
  console.log(svc.getConfigDigest());
  process.exit(0);
}

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!cond) failed++;
}

// 1. MDC SHA-256
const sample = 'Розділ 1: Тестовий текст рукопису';
const h = svc.computeSha256Hex(sample);
check('SHA-256 відомий вектор ("abc")', svc.computeSha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('Звірка незміненого файлу', svc.verifyDataIntegrity(sample, h));
check('Виявлення зміни 1 символу', !svc.verifyDataIntegrity(sample + '.', h));
check('Відхилення порожнього хешу', !svc.verifyDataIntegrity(sample, ''));
const manifest = svc.buildHashManifest(sample, 'book.txt');
const parsed = svc.parseHashManifest(manifest);
check('Маніфест .sha256 round-trip', parsed && parsed.hash === h && parsed.fileName === 'book.txt');

// 2. Підпис ліцензії
const token = svc.DEMO_PRO_LICENSE_TOKEN;
const lic = svc.parseLicenseToken(token);
check('Демо-токен розпарсено', lic && lic.tier === 'PRO');
check('Валідний підпис демо-ліцензії', svc.verifyLicenseSignature(lic).valid);
check('Підміна tier FREE->PRO (інший userId) відхилена', !svc.verifyLicenseSignature({ ...lic, userId: 'attacker' }).valid);
check('Підміна expiresAt відхилена', !svc.verifyLicenseSignature({ ...lic, expiresAt: '2099-01-01T00:00:00.000Z' }).valid);
check('Пошкоджений підпис відхилено', !svc.verifyLicenseSignature({ ...lic, signature: 'AAAA' }).valid);
check('Ліцензія без підпису відхилена', !svc.verifyLicenseSignature({ ...lic, signature: undefined }).valid);

// Підпис чужим ключем (атакуючий генерує власну пару) має бути відхилений
const attacker = forge.pki.rsa.generateKeyPair({ bits: 1024 });
const md = forge.md.sha256.create();
md.update(['LICv1', 'attacker', 'PRO', '2099-01-01T00:00:00.000Z'].join('|'), 'utf8');
const forged = { userId: 'attacker', tier: 'PRO', expiresAt: '2099-01-01T00:00:00.000Z', signature: forge.util.encode64(attacker.privateKey.sign(md)) };
check('Ліцензія, підписана чужим ключем, відхилена', !svc.verifyLicenseSignature(forged).valid);

// 3. Тарифи
check('Valid PRO => тариф PRO', svc.evaluateLicense(lic).tier === 'PRO');
const expired = svc.evaluateLicense(lic, new Date('2031-06-01'));
check('Прострочена ліцензія => FREE/EXPIRED', expired.tier === 'FREE' && expired.reason === 'EXPIRED');
check('Без ліцензії => FREE', svc.evaluateLicense(null).tier === 'FREE');
check('Підроблена ліцензія => FREE', svc.evaluateLicense(forged).tier === 'FREE');
check('FREE: редагування та .txt дозволено', svc.tierHasFeature('FREE', 'EDIT_BOOKS') && svc.tierHasFeature('FREE', 'EXPORT_TXT'));
check('FREE: .docx / статистика / шифрування заборонено',
  !svc.tierHasFeature('FREE', 'EXPORT_DOCX') && !svc.tierHasFeature('FREE', 'DETAILED_STATS') && !svc.tierHasFeature('FREE', 'CHAPTER_ENCRYPTION'));
check('PRO: .docx / статистика / шифрування дозволено',
  svc.tierHasFeature('PRO', 'EXPORT_DOCX') && svc.tierHasFeature('PRO', 'DETAILED_STATS') && svc.tierHasFeature('PRO', 'CHAPTER_ENCRYPTION'));

// 4. Цілісність конфігурації
const env = svc.verifyEnvironmentIntegrity();
check('Цілісність конфігурації (дайджест збігається)', env.ok);

console.log(failed ? `\nПровалено тестів: ${failed}` : '\nУсі тести пройдено.');
process.exit(failed ? 1 : 0);
