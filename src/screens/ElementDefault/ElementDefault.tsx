import React from "react";
import "./style.css";

export const ElementDefault = (): JSX.Element => {
  return (
    <div className="element-default">
      <div className="main">
        <div className="background-border">
          <div className="container">
            <div className="horizontal-border">
              <div className="heading-images">Images</div>

              <div className="button">
                <img className="SVG" alt="Svg" src="/img/svg.svg" />
              </div>
            </div>

            <div className="overlay-shadow" />

            <div className="overlap">
              <div className="overlay-border">
                <div className="textarea">
                  <p className="text-wrapper">
                    Describe what you want to see...
                  </p>
                </div>

                <div className="button-menu">
                  <div className="overlap-group">
                    <div className="background" />

                    <img className="img" alt="Svg" src="/img/svg-1.svg" />
                  </div>
                </div>

                <div className="overlap-wrapper">
                  <div className="overlap-group">
                    <div className="background" />

                    <img className="img" alt="Svg" src="/img/svg-2.svg" />
                  </div>
                </div>

                <div className="overlap-group-wrapper">
                  <div className="overlap-group">
                    <div className="background" />

                    <div className="div">1x</div>
                  </div>
                </div>

                <div className="div-wrapper">
                  <div className="overlap-group">
                    <div className="background" />

                    <img className="img" alt="Svg" src="/img/svg-3.svg" />
                  </div>
                </div>

                <div className="SVG-wrapper">
                  <img className="img" alt="Svg" src="/img/svg-4.svg" />
                </div>
              </div>
            </div>

            <div className="overlay-shadow-2" />
          </div>
        </div>
      </div>

      <div className="container-2">
        <div className="button-2">
          <div className="container-3">
            <div className="container-4">
              <div className="text-wrapper-2">ELIXOVS GLOBA…</div>
            </div>

            <div className="background-2">
              <div className="text-wrapper-3">E</div>
            </div>
          </div>

          <img className="SVG-2" alt="Svg" src="/img/svg-5.svg" />
        </div>

        <div className="text-wrapper-4">/</div>

        <div className="button-dialog">
          <div className="overlap-group-2">
            <div className="background-3" />

            <div className="container-5">
              <div className="text-wrapper-5">AI Image Ge</div>
            </div>

            <img className="SVG-3" alt="Svg" src="/img/svg-6.svg" />
          </div>
        </div>

        <div className="button-3">
          <div className="horizontal-divider" />

          <div className="horizontal-divider-2" />
        </div>
      </div>
    </div>
  );
};
