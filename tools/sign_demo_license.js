/**
 * DEV-ONLY утиліта видачі демонстраційної ліцензії (ЛР №5).
 *
 * Генерує ОДНОРАЗОВУ пару RSA-2048 у пам'яті, підписує ліцензійний об'єкт приватним
 * ключем і друкує публічний ключ та підписаний токен. Приватний ключ НЕ записується
 * на диск і НЕ потрапляє до репозиторію/клієнтського коду — після завершення процесу
 * він знищується. У реальному середовищі підпис виконує серверна частина розробника
 * (HSM/KMS), а клієнт отримує лише публічний ключ.
 *
 * Використання: node tools/sign_demo_license.js [userId] [expiresAtISO]
 */
const forge = require('node-forge');

const userId = process.argv[2] || 'demo-user-001';
const expiresAt = process.argv[3] || '2030-12-31T23:59:59.000Z';

const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

const canonical = ['LICv1', userId, 'PRO', expiresAt].join('|');
const md = forge.md.sha256.create();
md.update(canonical, 'utf8');
const signature = forge.util.encode64(privateKey.sign(md));

const license = { userId, tier: 'PRO', expiresAt, signature };

console.log('--- PUBLIC KEY (вставити в licenseIntegrityService.js) ---');
console.log(forge.pki.publicKeyToPem(publicKey));
console.log('--- SIGNED LICENSE TOKEN (base64 JSON) ---');
console.log(forge.util.encode64(JSON.stringify(license)));
