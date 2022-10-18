import dockerCompose from 'docker-compose';
import path from 'path';

export default async function setup() {
  try {
    await dockerCompose.upAll({
      cwd: path.join(__dirname),
      log: true,
    });
  } catch (err) {
    console.error(
      'Unable to start required containers, make sure your docker service is running - ',
      err,
    );
  }
}
