"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const config_1 = require("./config");
const common_1 = require("@nestjs/common");
try {
    (0, config_1.initialize)();
}
catch (error) {
    console.error(error.message);
    process.exit(1);
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: false,
    }));
    const uploadsPath = (0, path_1.resolve)(config_1.UPLOAD_PATH);
    console.log('UPLOADS PATH RESOLVED TO:', uploadsPath);
    app.useStaticAssets(uploadsPath, {
        prefix: '/uploads',
    });
    await app.listen(config_1.PORT);
}
bootstrap();
//# sourceMappingURL=main.js.map