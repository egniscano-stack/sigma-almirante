const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require("path");

const config = {
    user: "u485332576.coral-hawk-194254.hostingersite.com",
    password: "J@seph1905041984",
    host: "195.179.239.248",
    port: 21,
    localRoot: path.join(__dirname, "../dist"),
    remoteRoot: "/",
    include: ["*", "**/*"],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

console.log("Iniciando subida de archivos de producción a Hostinger vía FTP...");

ftpDeploy
    .deploy(config)
    .then((res) => {
        console.log("\n¡Despliegue completado con éxito!");
        console.log("Archivos subidos:", res);
    })
    .catch((err) => {
        console.error("\nError durante el despliegue FTP:", err);
        process.exit(1);
    });
