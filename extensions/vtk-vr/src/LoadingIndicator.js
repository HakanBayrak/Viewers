import './LoadingIndicator.css';

import React, { PureComponent } from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

class LoadingIndicator extends PureComponent {
  static propTypes = {
    percentComplete: PropTypes.number.isRequired,
    error: PropTypes.object,
    t: PropTypes.func,
  };

  static defaultProps = {
    percentComplete: 0,
    error: null,
  };

  render() {
    const { t, percentComplete } = this.props;
    return (
      <React.Fragment>
        {this.props.error ? (
          <div className="imageViewerErrorLoadingIndicator loadingIndicator">
            <div className="indicatorContents">
              <h4>{t('Error Loading Image')}</h4>
              <p className="description">{t('An error has occurred')}</p>
              <p className="details">{this.props.error.message}</p>
            </div>
          </div>
        ) : (
          <div className="imageViewerLoadingIndicator loadingIndicator">
            <div className="indicatorContents">
              <p>
                {this.props.t('Loading...', {
                  percComplete: percentComplete
                    ? percentComplete.toString()
                    : '',
                  percentSign: percentComplete ? '%' : '',
                })}
                <i className="fa fa-spin fa-circle-o-notch fa-fw" />
              </p>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }
}

export default withTranslation('Common')(LoadingIndicator);
