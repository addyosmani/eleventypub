const React = require("react");
const { renderToString } = require("react-dom/server");
const theSadness = require("./webpack-sadness");
const path = require("path");
const requireFromString = require("require-from-string");
const ROOT_ID = "MDX_ROOT";

function replaceAll(string, search, replace) {
  return string.split(search).join(replace);
}

  
let HYDRATE_SCRIPT = "";
module.exports = (
  eleventyConfig,
  { components = {}, webpackConfig = {} } = {}
) => {
  process.env.ELEVENTY_EXPERIMENTAL = "true";
  eleventyConfig.addTemplateFormats("mdx");
  eleventyConfig.addExtension("mdx", {
    init: async () => {
      const sadness = await theSadness(
        {
          hydrate: require.resolve(path.join(__dirname, "hydrate.js")),
        },
        { externals: undefined, ...webpackConfig }
      );
      HYDRATE_SCRIPT = sadness["hydrate.js"];
    },
    compile: (_, inputPath) => async (props) => {
      const serverSadness = await theSadness(
        { main: inputPath },
        { target: "node" }
      );
      const sadness = await theSadness({ main: inputPath });

      const { Component } = requireFromString(
        `const React = require("react");
${serverSadness["main.js"]}
const Component = MDXPlugin_main.default || MDXPlugin_main;
const serializeEleventyProps = MDXPlugin_main.serializeEleventyProps;
module.exports = { Component, serializeEleventyProps }
`
      );

      const rootComponent = React.createElement(
        "div",
        // I'm wrapping this in a div with an explicit ID to ensure I always hydrate the right container
        { id: ROOT_ID },
        React.createElement(Component, { components, ...props }, null)
      );

      // Toggle based on some configuration
      let hydrationOn = false;
      
      let hydrateScript = ``;
      if (hydrationOn) {

       hydrateScript = `
        <script>
        (function(){
          ${HYDRATE_SCRIPT}
          const hydrate = MDXPlugin_hydrate.hydrate;
          const React = MDXPlugin_hydrate.React;

          ${sadness["main.js"]}
          const Component = MDXPlugin_main.default || MDXPlugin_main;
         
          hydrate(
            Component,
            { components: {} },
            document.querySelector('#${ROOT_ID}')
          );
        })();
        </script>`;
      }

      let mdxMarkUp = renderToString(rootComponent);
      
      // Remove scripts
      mdxMarkUp = mdxMarkUp.replace(/<script[^>]*>(?:(?!<\/script>)[^])*<\/script>/g, '');
      // Remove images
      mdxMarkUp = mdxMarkUp.replace(/<img[^>]*>(?:(?!<\/img>)[^])*<\/img>/g, '');
      // Replace generated iframe divs with links
      mdxMarkUp = mdxMarkUp.replace(/<div\s+src=(".*?").*?<\/div>/g, '<a href=$1>Link to CodeSandbox</a>');
      // More cleanup for imports
      // mdxMarkUp = replaceAll(mdxMarkUp, 'import { IFrame }', '> import { IFrame }')
      
      return mdxMarkUp + "\n" + hydrateScript;
    },
  });
};
