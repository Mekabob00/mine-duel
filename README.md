# Mine Duel

모바일 브라우저에서 실행하는 턴제 지뢰찾기 × 심리전.
HTML/CSS/JavaScript ES Modules, 프레임워크/서버/DB 없이 동작합니다.

- 원본: [web/](web/)
- GitHub Pages 정적 배포본: [docs/](docs/)
- 실행/규칙/테스트/배포 방법: [web/README.md](web/README.md)

```sh
npm run start --prefix web
```

http://127.0.0.1:4173/web/ 에서 실행합니다.

Settings → Pages → Source를 GitHub Actions로 설정하면 main push마다 테스트를 통과한 docs 배포본이 자동 배포됩니다.
배포 성공 여부와 실제 URL은 Actions / Settings → Pages에서 확인하세요.

Unity 원본은 이 저장소의 상위 로컬 프로젝트 폴더에 유지되어 있으며 웹게임만 저장소에 반영합니다.
